import os
import uuid
import shutil
import urllib.request
import xml.etree.ElementTree as ET
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Enable CORS since your frontend will call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production to your actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION ---
# Database connection parameters
DATABASE_URL = os.getenv("DATABASE_URL")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "homepage")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "root@123#$$")
DB_PORT = os.getenv("DB_PORT", "5432")

# Directory to save files (use /tmp on Vercel due to read-only filesystem)
IS_VERCEL = "VERCEL" in os.environ
UPLOAD_DIR = "/tmp/uploads" if IS_VERCEL else "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount the uploads directory to serve files statically
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# --- DATABASE CONNECTION ---
def get_db_connection():
    try:
        if DATABASE_URL:
            conn = psycopg2.connect(DATABASE_URL)
        else:
            conn = psycopg2.connect(
                host=DB_HOST,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                port=DB_PORT
            )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

# Initialize the database table
def init_db():
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS wallpapers (
                        id SERIAL PRIMARY KEY,
                        filename VARCHAR(255) NOT NULL,
                        filepath VARCHAR(512) NOT NULL,
                        content_type VARCHAR(100),
                        size_bytes BIGINT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cur.execute("ALTER TABLE wallpapers ENABLE ROW LEVEL SECURITY;")
                cur.execute("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_policies
                            WHERE policyname = 'Restrict all access'
                              AND tablename = 'wallpapers'
                        ) THEN
                            CREATE POLICY "Restrict all access" ON wallpapers
                            FOR ALL
                            TO PUBLIC
                            USING (false);
                        END IF;
                    END
                    $$;
                """)
                conn.commit()
            print("Database is successfully connected!")
        except Exception as e:
            print(f"Error initializing database: {e}")
        finally:
            conn.close()
    else:
        print("Database connection failed!")

init_db()

# --- API ENDPOINTS ---

@app.post("/upload-wallpaper/")
async def upload_wallpaper(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # Create a unique filename to prevent overwriting
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save the file locally
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
    
    # Save file metadata to PostgreSQL
    file_size = os.path.getsize(file_path)
    url_path = f"/uploads/{unique_filename}"
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO wallpapers (filename, filepath, content_type, size_bytes) VALUES (%s, %s, %s, %s) RETURNING id",
                (file.filename, url_path, file.content_type, file_size)
            )
            inserted_id = cur.fetchone()[0]
            conn.commit()
    except Exception as e:
        # If DB insert fails, we should ideally clean up the saved file
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        conn.close()
        
    return {"message": "Wallpaper uploaded successfully", "id": inserted_id, "url": url_path}


@app.get("/news/")
async def get_news():
    news_api_key = os.getenv("NEWS_API_KEY")
    news_items = []
    
    # Try NewsAPI if a valid key is provided
    if news_api_key and news_api_key.strip() and news_api_key != "YOUR_API_KEY":
        url = f"https://newsapi.org/v2/top-headlines?country=in&category=technology&apiKey={news_api_key}"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                import json
                data = json.loads(response.read().decode())
                if data.get("status") == "ok":
                    articles = data.get("articles", [])
                    count = 0
                    for article in articles:
                        if count >= 15:
                            break
                        title_text = article.get("title", "")
                        link_text = article.get("url", "")
                        pub_date_text = article.get("publishedAt", "")
                        source_dict = article.get("source", {})
                        source_name = source_dict.get("name", "NewsAPI") if source_dict else "NewsAPI"
                        
                        if title_text:
                            title_parts = title_text.rsplit(' - ', 1)
                            if len(title_parts) > 1:
                                clean_title = title_parts[0]
                            else:
                                clean_title = title_text
                                
                            news_items.append({
                                "title": clean_title,
                                "source": source_name,
                                "link": link_text,
                                "pub_date": pub_date_text
                            })
                            count += 1
        except Exception as e:
            print(f"Error fetching NewsAPI, falling back to Google News: {e}")
            
    # Fallback to Google News RSS
    if not news_items:
        url = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                xml_data = response.read()
                root = ET.fromstring(xml_data)
                
                count = 0
                for item in root.findall('.//item'):
                    if count >= 15:
                        break
                    title = item.find('title')
                    link = item.find('link')
                    pub_date = item.find('pubDate')
                    source = item.find('source')
                    
                    title_text = title.text if title is not None else ""
                    link_text = link.text if link is not None else ""
                    pub_date_text = pub_date.text if pub_date is not None else ""
                    source_text = source.text if source is not None else ""
                    
                    if title_text:
                        title_parts = title_text.rsplit(' - ', 1)
                        if len(title_parts) > 1:
                            clean_title = title_parts[0]
                            source_name = title_parts[1]
                        else:
                            clean_title = title_text
                            source_name = source_text if source_text else "Google News"
                            
                        news_items.append({
                            "title": clean_title,
                            "source": source_name,
                            "link": link_text,
                            "pub_date": pub_date_text
                        })
                        count += 1
        except Exception as e:
            print(f"Error fetching Google News: {e}")
            
    if not news_items:
        news_items = [
            {
                "title": "News is temporarily unavailable. Check back later.",
                "source": "News Hub",
                "link": "https://news.google.com",
                "pub_date": ""
            }
        ]
        
    return {"news": news_items}


@app.get("/wallpapers/")
async def list_wallpapers():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM wallpapers ORDER BY created_at DESC")
            wallpapers = cur.fetchall()
            return {"wallpapers": wallpapers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        conn.close()


@app.get("/suggestions/")
async def get_suggestions(q: str = ""):
    if not q:
        return {"suggestions": []}
    try:
        import json
        import urllib.parse
        url = f"https://suggestqueries.google.com/complete/search?client=firefox&q={urllib.parse.quote(q)}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as response:
            data = json.loads(response.read().decode())
            suggestions = data[1] if len(data) > 1 else []
            return {"suggestions": suggestions}
    except Exception as e:
        print(f"Error fetching suggestions: {e}")
        return {"suggestions": []}


# Mount the frontend directory to serve the website statically (registered last)
app.mount("/", StaticFiles(directory="../", html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

import sys
from pathlib import Path

# Add backend directory to python path if run standalone
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from database import Base, engine, DATABASE_URL
from sqlalchemy import text

def run_migrations():
    print(f"Running database migrations on: {DATABASE_URL}")
    try:
        # Create all tables defined in models
        Base.metadata.create_all(bind=engine)
        
        # Add new columns to existing table if they don't exist yet (for sqlite compatibility)
        with engine.connect() as conn:
            # Check if columns exist in analysis_history
            result = conn.execute(text("PRAGMA table_info(analysis_history)"))
            existing_columns = [row[1] for row in result.fetchall()]
            
            if "health_explanation" not in existing_columns:
                print("Adding column 'health_explanation' to 'analysis_history'")
                conn.execute(text("ALTER TABLE analysis_history ADD COLUMN health_explanation TEXT"))
            if "rul_explanation" not in existing_columns:
                print("Adding column 'rul_explanation' to 'analysis_history'")
                conn.execute(text("ALTER TABLE analysis_history ADD COLUMN rul_explanation TEXT"))
                
        print("Database migrations applied successfully! (Tables initialized)")
    except Exception as e:
        print(f"Error applying database migrations: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()

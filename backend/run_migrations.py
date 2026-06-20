import sys
from pathlib import Path

# Add backend directory to python path if run standalone
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from database import Base, engine, DATABASE_URL

def run_migrations():
    print(f"Running database migrations on: {DATABASE_URL}")
    try:
        # Create all tables defined in models
        Base.metadata.create_all(bind=engine)
        print("Database migrations applied successfully! (Tables initialized)")
    except Exception as e:
        print(f"Error applying database migrations: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()

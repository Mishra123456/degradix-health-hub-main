import os
import sys
import subprocess
from pathlib import Path

# Ensure huggingface_hub is installed
try:
    from huggingface_hub import HfApi
except ImportError:
    print("Installing huggingface_hub package...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])
    from huggingface_hub import HfApi

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "ml"

REQUIRED_FILES = [
    "rf_health.joblib",
    "rf_rul.joblib",
    "scaler.joblib",
    "lstm_rul.keras",
    "metrics.json"
]

def main():
    print("=" * 60)
    print("      DEGRADIX ML MODEL UPLOADER FOR HUGGING FACE HUB")
    print("=" * 60)
    
    # 1. Verify files exist
    missing_files = []
    for f in REQUIRED_FILES:
        path = MODEL_DIR / f
        if not path.exists():
            missing_files.append(f)
            
    if missing_files:
        print("\n[ERROR] The following model files were not found in backend/ml/:")
        for f in missing_files:
            print(f"  - {f}")
        print("\nPlease run model training first to generate them:")
        print("  cd backend")
        print("  python train_models.py")
        print("=" * 60)
        sys.exit(1)
        
    print("\nAll model files verified in backend/ml/.")

    # 2. Get credentials
    print("\nTo upload your models, you need a Hugging Face Access Token.")
    print("Get it from: https://huggingface.co/settings/tokens (requires 'write' permission)")
    hf_token = input("Enter your Hugging Face Access Token: ").strip()
    if not hf_token:
        print("[ERROR] Hugging Face Access Token is required.")
        sys.exit(1)
        
    try:
        api = HfApi(token=hf_token)
        user_info = api.whoami()
        username = user_info.get("name")
        print(f"\n[INFO] Logged in successfully as Hugging Face user: '{username}'")
    except Exception as e:
        print(f"\n[ERROR] Failed to authenticate with Hugging Face Token: {e}")
        print("Please verify your token and make sure it has 'write' permission.")
        sys.exit(1)
        
    suggested_repo = f"{username}/degradix-models"
    repo_id = input(f"\nEnter your desired Repository ID [Default: {suggested_repo}]: ").strip()
    if not repo_id:
        repo_id = suggested_repo

    # 3. Create repository and upload
    try:
        print(f"\nCreating/Verifying model repository '{repo_id}'...")
        api.create_repo(repo_id=repo_id, repo_type="model", exist_ok=True)
        
        print("\nUploading model files to Hugging Face Hub (this may take a minute)...")
        for filename in REQUIRED_FILES:
            file_path = MODEL_DIR / filename
            print(f"  Uploading {filename}...")
            api.upload_file(
                path_or_fileobj=str(file_path),
                path_in_repo=filename,
                repo_id=repo_id,
                repo_type="model"
            )
            
        print("\n" + "=" * 60)
        print("🎉 SUCCESS! All model files have been uploaded to Hugging Face Hub.")
        print("=" * 60)
        print("\nSet these Environment Variables in your Render Dashboard:")
        print(f"  HF_MODEL_ID = {repo_id}")
        print(f"  HF_TOKEN    = {hf_token}")
        print("\nOnce set, redeploy your Render service. It will run under ~75MB RAM.")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[ERROR] An error occurred during upload: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

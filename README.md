# Tunnel of Consciousness

## Building

1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   ```bash
      npm install
      cd backend/python
      pythom -m venv venv
      pip install -r requirements.txt
   ```
   (Optional: For GPU with cuda) Install torch library with cuda support from [here](https://pytorch.org/get-started/locally/).
3. Start the development server: (In project root)
   ```bash
      npm run dev-windows # for windows
      npm run dev-linux # for linux
   ```

### Running servers individually

1. Frontend: Inside `frontend` run `npm run dev`
2. Backend: Inside `backend` run `npm run dev-{platform}`
3. Inference: Inside `backend/python` activate the virtual env with `venv\Scprits\activate` then run `uvicorn main:app --reload --port 8000`

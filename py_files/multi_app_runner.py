import multiprocessing
import uvicorn
import time

def start_service(app_import_string, port):
    """Starts a Uvicorn server for a specific app and port."""
    # reload=False is recommended for production/multiprocessing
    uvicorn.run(app_import_string, host="0.0.0.0", port=port, reload=False)

if __name__ == "__main__": 
    # List of tuples: (app_import_string, port)
    # Replace 'resume_optimizer:app' with your actual file and app names
    services = [
        ("resume_optimizer:app", 8080),  # Your existing app
        ("doc_summarizer:app", 8000),   # Example second app
        ("chatbot:app", 8083),    # Example third app
    ]

    processes = []

    print(f"Starting {len(services)} services...")

    for app_str, port in services:
        p = multiprocessing.Process(target=start_service, args=(app_str, port))
        p.start()
        processes.append(p)
        print(f" -> Started {app_str} on port {port}")

    # Keep the main script running to monitor processes
    try:
        for p in processes:
            p.join()
    except KeyboardInterrupt:
        print("\nStopping all services...")
        for p in processes:
            p.terminate()
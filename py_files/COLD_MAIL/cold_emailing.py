import requests

# Your webhook Test URL (get from n8n Webhook node)
WEBHOOK_URL = "https://vardan78.app.n8n.cloud/webhook-test/send-cold-mail"

# Test data
payload = {
    "resume_url": "https://drive.google.com/file/d/1G1TG6TI8Q4Es5T4b0OQC-l4tNuHI--XY/view?usp=drive_link",
    "candidate_email": "yourtest@gmail.com",
    "recruiter's_email": "dixitsaurabh587@gmail.com",
    "job_description": """
    Senior Python Developer Position
    
    Requirements:
    - 5+ years Python experience
    - FastAPI/Django knowledge
    - AWS deployment experience
    
    Interested candidates please contact: dixitsaurabh587@gmail.com
    
    We offer competitive salary and great benefits.
    """
}

# Send request
print("Sending test data to n8n webhook...")
response = requests.post(WEBHOOK_URL, json=payload)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
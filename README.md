# 📄 ResumeIQ - Comprehensive AI career Suite

ResumeIQ is a cutting-edge, AI-powered career assistant designed to help professionals optimize their resumes, analyze skill gaps, and master mock interviews. Built with a modern tech stack, it provides a seamless experience for job seekers to land their dream roles.

---

## 🚀 Key Features

### 1. 📝 AI Resume Optimizer
- **ATS Optimization**: Enhance your resume to pass through Applicant Tracking Systems.
- **Smart Suggestions**: Get real-time AI feedback on your resume content and structure.
- **Instant Previews**: See how your optimized resume looks instantly.

### 2. 🎯 Smart Skill Gap Analysis
- **Job Matching**: Compare your resume against specific job descriptions.
- **Gap Identification**: Visualize missing skills and areas for improvement.
- **Personalized Recommendations**: Get actionable advice on what to learn next.

### 3. 🎙️ AI Mock Interview Prep
- **Dynamic Questioning**: Practice with AI that generates questions based on your resume and target role.
- **Real-time Feedback**: Receive immediate evaluations of your responses.
- **Session Reports**: Track your progress with detailed performance metrics.

### 4. 🤖 AI Career Chatbot
- **24/7 Support**: Ask career-related questions anytime.
- **Resume Advice**: Get quick tips on formatting and content.
- **Interview Tips**: Quick pointers for your upcoming interviews.

### 5. 📧 Smart Cold Emailer
- **Automated Outreach**: Generate personalized cold emails for recruiters and hiring managers.
- **N8N Integration**: Seamlessly connected for efficient outreach workflows.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15+
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **UI Components**: Radix UI, Lucide Icons
- **State Management**: React Context API

### Backend
- **Core**: FastAPI (Python 3.10+)
- **Concurrency**: Multiple specialized services (Summarizer, Optimizer, QA, Chatbot)
- **OCR/PDF Processing**: PyMuPDF, PyPDF2
- **Audio Processing**: SoundDevice, SoundFile

### Database & Cloud
- **Database**: MongoDB (Atlas)
- **Object Modeling**: Mongoose
- **Media Storage**: Cloudinary
- **Automation**: N8N Webhooks

---

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- MongoDB Account (Atlas or Local)
- Groq API Key (for AI features)

### 1. Clone the Repository
```bash
git clone https://github.com/Shashwat023/Resume-intelligence-suite.git
cd Resume-intelligence-suite
```

### 2. Frontend Setup
```bash
npm install
```

### 3. Backend Setup
It's recommended to use a virtual environment:
```bash
# Example for Skill Gap Analyzer
cd py_files/SKILL_GAP_ANALYZER
python -m venv venv
source venv/bin/Scripts/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### 4. Environment Variables
Create a `.env` file in the root directory and add the following:
```env
GROQ_API_KEY=your_groq_api_key
MONGODB_URI=your_mongodb_connection_string
CLOUDINARY_URL=your_cloudinary_url
N8N_COLD_MAIL_URL=your_n8n_webhook_url
# Optional URLs if running services on different ports
INTERVIEW_API_URL=http://localhost:8081
SKILL_GAP_API_URL=http://localhost:8002
```

---

## 🏃 Running the Application

To start both the Next.js frontend and all Python backend services concurrently:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## 📁 Project Structure

- `/app`: Next.js app router and API routes.
- `/components`: Reusable UI components.
- `/py_files`: Python backend services (FastAPI).
- `/backend`: Mongoose models and server-side scripts.
- `/public`: Static assets.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

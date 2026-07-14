import fitz
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
import os
import re
import math
from typing import List, Union, Dict
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import shutil
from tempfile import NamedTemporaryFile
from collections import Counter

load_dotenv()


# ─────────────────────────────────────────────
# Simple TF-IDF vector store (no external model)
# ─────────────────────────────────────────────

def tokenize(text: str) -> List[str]:
    """Simple word tokenizer."""
    return re.findall(r"[a-z0-9']+", text.lower())


class SimpleVectorStore:
    """
    Lightweight TF-IDF + cosine-similarity vector store.
    Needs no external model downloads.
    """

    def __init__(self):
        self.documents: List[Document] = []
        self.tfidf_vectors: List[Dict[str, float]] = []
        self.idf: Dict[str, float] = {}

    def _compute_tf(self, tokens: List[str]) -> Dict[str, float]:
        count = Counter(tokens)
        total = max(len(tokens), 1)
        return {term: freq / total for term, freq in count.items()}

    def _compute_idf(self):
        n = len(self.documents)
        df: Dict[str, int] = {}
        for doc in self.documents:
            for term in set(tokenize(doc.page_content)):
                df[term] = df.get(term, 0) + 1
        self.idf = {term: math.log((n + 1) / (freq + 1)) + 1 for term, freq in df.items()}

    def _tfidf(self, tokens: List[str]) -> Dict[str, float]:
        tf = self._compute_tf(tokens)
        return {term: tf_val * self.idf.get(term, 1.0) for term, tf_val in tf.items()}

    def _cosine_sim(self, vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
        keys = set(vec_a) & set(vec_b)
        if not keys:
            return 0.0
        dot = sum(vec_a[k] * vec_b[k] for k in keys)
        norm_a = math.sqrt(sum(v * v for v in vec_a.values()))
        norm_b = math.sqrt(sum(v * v for v in vec_b.values()))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def add_documents(self, documents: List[Document]):
        self.documents.extend(documents)
        self._compute_idf()
        # Recompute all vectors after IDF update
        self.tfidf_vectors = [
            self._tfidf(tokenize(doc.page_content)) for doc in self.documents
        ]

    def similarity_search(self, query: str, k: int = 5) -> List[Document]:
        if not self.documents:
            print("[WARNING] No documents in vector store")
            return []
        query_tokens = tokenize(query)
        query_vec = self._tfidf(query_tokens)
        scores = [
            (self._cosine_sim(query_vec, vec), i)
            for i, vec in enumerate(self.tfidf_vectors)
        ]
        scores.sort(reverse=True)
        results = [self.documents[i] for _, i in scores[:k]]
        print(f"[RETRIEVAL] Query: '{query}' -> Retrieved {len(results)} chunks with scores: {[s[0] for s in scores[:k]]}")
        return results

    def is_empty(self) -> bool:
        return len(self.documents) == 0


# ─────────────────────────────────────────────
# RAG Pipeline
# ─────────────────────────────────────────────

class EnhancedRAGPipeline:
    """
    RAG Pipeline using:
    - Simple TF-IDF vector store (no HuggingFace download required)
    - Groq LLM for answer generation
    - In-memory conversation history
    """

    def __init__(self, chunk_size=500, chunk_overlap=50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.vector_store = SimpleVectorStore()
        self.chat_history: List[Union[HumanMessage, AIMessage]] = []

        # Initialize Groq LLM with correct model name
        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.2
        )
        print("RAG Pipeline initialized (TF-IDF mode — no model download needed)!")

    def parse_pdf(self, file_path: str) -> str:
        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text

    def parse_txt(self, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    def chunk_text(self, text: str) -> List[str]:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", ".", " "]
        )
        return splitter.split_text(text)

    def process_files(self, file_paths: List[str]) -> int:
        all_chunks = []
        for file_path in file_paths:
            file_ext = Path(file_path).suffix.lower()
            try:
                if file_ext == ".pdf":
                    text = self.parse_pdf(file_path)
                elif file_ext == ".txt":
                    text = self.parse_txt(file_path)
                else:
                    print(f"Unsupported file type: {file_path}")
                    continue
                chunks = self.chunk_text(text)
                all_chunks.extend(chunks)
                print(f"  [SUCCESS] {len(chunks)} chunks from {Path(file_path).name}")
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                continue

        if all_chunks:
            documents = [Document(page_content=chunk) for chunk in all_chunks]
            self.vector_store.add_documents(documents)
            print(f"[SUCCESS] Total chunks in store: {len(self.vector_store.documents)}")
        else:
            print("[WARNING] No chunks generated from files")

        return len(all_chunks)

    def ask(self, question: str) -> dict:
        print(f"[QUERY] Received question: '{question}'")
        print(f"[QUERY] Total documents in store: {len(self.vector_store.documents)}")
        
        if self.vector_store.is_empty():
            print("[ERROR] No documents loaded")
            return {
                "answer": "No documents loaded. Please upload PDF or TXT files first.",
                "source_documents": []
            }

        # Retrieve top relevant chunks (increased from 5 to 10 for better context)
        docs = self.vector_store.similarity_search(question, k=10)
        
        if not docs:
            print("[WARNING] No documents retrieved from similarity search")
            return {
                "answer": "No relevant information found in the uploaded documents. Please try rephrasing your question.",
                "source_documents": []
            }
        
        context = "\n\n".join(doc.page_content for doc in docs)
        print(f"[CONTEXT] Built context with {len(docs)} chunks, total length: {len(context)} characters")
        print(f"[CONTEXT] First chunk preview: {docs[0].page_content[:200]}...")

        # Build conversation history text (last 4 messages)
        history_text = ""
        if self.chat_history:
            history_text = "\n".join([
                f"{'Human' if isinstance(msg, HumanMessage) else 'AI'}: {msg.content}"
                for msg in self.chat_history[-4:]
            ])

        prompt = PromptTemplate(
            input_variables=["context", "chat_history", "question"],
            template="""You are a knowledgeable AI assistant. Answer questions based on the provided context and conversation history.

Instructions:
- Use the context and conversation history to construct your answer.
- The context contains relevant information from uploaded documents. Use it to answer the question.
- If you can find relevant information in the context, use it to provide a detailed answer.
- Only say "The provided context does not contain enough information" if the context is completely empty or irrelevant.
- Be concise, factual, and avoid speculation.
- Reference previous parts of the conversation when relevant.
- Format your answer as readable text with short paragraphs and bullet lists where helpful.

Chat History:
{chat_history}

Context from documents:
{context}

Question:
{question}

Answer:"""
        )

        print(f"[LLM] Invoking LLM with context length: {len(context)} characters")
        chain = prompt | self.llm | StrOutputParser()
        answer = chain.invoke({
            "context": context,
            "chat_history": history_text,
            "question": question
        })
        print(f"[LLM] Received answer with length: {len(answer)} characters")

        self.chat_history.append(HumanMessage(content=question))
        self.chat_history.append(AIMessage(content=answer))

        return {"answer": answer, "source_documents": docs}

    def clear_memory(self):
        self.chat_history = []

    def get_chat_history(self) -> List[str]:
        return [
            f"{'You' if isinstance(msg, HumanMessage) else 'Bot'}: {msg.content}"
            for msg in self.chat_history
        ]


# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────

app = FastAPI(title="RAG Chatbot API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_pipeline = EnhancedRAGPipeline()


class QuestionRequest(BaseModel):
    question: str


class AnswerResponse(BaseModel):
    answer: str
    source_documents: List[str]


class UploadResponse(BaseModel):
    message: str
    files_processed: int
    total_chunks: int


@app.get("/")
async def root():
    return {
        "message": "RAG Chatbot API is running",
        "endpoints": {
            "/upload": "POST - Upload PDF/TXT files",
            "/ask": "POST - Ask a question",
            "/history": "GET - Get chat history",
            "/clear": "POST - Clear memory",
            "/health": "GET - Health check"
        }
    }


@app.post("/upload", response_model=UploadResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    temp_file_paths = []
    try:
        for file in files:
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in [".pdf", ".txt"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {file.filename}. Only PDF and TXT allowed."
                )
            with NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                shutil.copyfileobj(file.file, tmp)
                temp_file_paths.append(tmp.name)

        total_chunks = rag_pipeline.process_files(temp_file_paths)
        return UploadResponse(
            message="Files processed successfully",
            files_processed=len(files),
            total_chunks=total_chunks
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing files: {str(e)}")
    finally:
        for path in temp_file_paths:
            try:
                os.unlink(path)
            except Exception:
                pass


@app.post("/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    try:
        result = rag_pipeline.ask(request.question)
        return AnswerResponse(
            answer=result["answer"],
            source_documents=[
                doc.page_content[:200] + "..." for doc in result["source_documents"]
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/history")
async def get_history():
    return {"chat_history": rag_pipeline.get_chat_history()}


@app.post("/clear")
async def clear_memory():
    rag_pipeline.clear_memory()
    return {"message": "Memory cleared successfully"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "documents_loaded": len(rag_pipeline.vector_store.documents),
        "retriever_ready": not rag_pipeline.vector_store.is_empty()
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8083, reload=True)

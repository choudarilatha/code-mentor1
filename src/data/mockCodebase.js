export const mockCodebase = {
  projectName: "CodeMentor AI",
  version: "1.0.0",
  stats: {
    loc: 2450,
    filesCount: 12,
    classesCount: 8,
    functionsCount: 28,
    languages: [
      { name: "Python", percentage: 75, color: "#3572A5" },
      { name: "JavaScript", percentage: 15, color: "#f1e05a" },
      { name: "HTML/CSS", percentage: 10, color: "#e34c26" }
    ]
  },
  files: {
    "README.md": {
      name: "README.md",
      type: "markdown",
      path: "README.md",
      content: `# CodeMentor AI - Intelligent Codebase Onboarding Agent

CodeMentor AI is a Retrieval-Augmented Generation (RAG) system designed to onboard developers to new codebases. It indexes software repositories, extracts modules/classes/functions using AST parsers, stores embeddings in a vector database, and uses an LLM to answer questions grounded in the repository's code.

## Architecture

\`\`\`
[ codebase ] -> [ ast parser ] -> [ chunking ] -> [ embedder ] -> [ vector store ]
                                                                       |
[ user query ] -> [ query embedder ] -> [ similarity search ] -> [ context ] -> [ LLM ] -> [ answer ]
\`\`\`

## Quick Start

1. Set up your environment:
   \`\`\`bash
   pip install -r requirements.txt
   export OPENAI_API_KEY="your-key"
   \`\`\`
2. Ingest the codebase:
   \`\`\`bash
   python backend/parser.py --dir ./my-project
   \`\`\`
3. Run the API server:
   \`\`\`bash
   python backend/app.py
   \`\`\`
`
    },
    "requirements.txt": {
      name: "requirements.txt",
      type: "text",
      path: "requirements.txt",
      content: `fastapi>=0.100.0
uvicorn>=0.22.0
langchain>=0.0.250
openai>=1.0.0
chromadb>=0.4.5
tree-sitter>=0.20.1
pydantic>=2.0
`
    },
    "backend": {
      name: "backend",
      type: "directory",
      children: {
        "app.py": {
          name: "app.py",
          type: "python",
          path: "backend/app.py",
          content: `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from backend.rag_agent import RAGAgent

app = FastAPI(title="CodeMentor AI API")
agent = RAGAgent()

class QueryRequest(BaseModel):
    query: str
    repository_path: str = "./"

class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]

@app.post("/api/query", response_model=QueryResponse)
async def query_codebase(request: QueryRequest):
    """
    Endpoint to ask questions about the current codebase.
    """
    try:
        answer, sources = agent.answer_query(request.query)
        return QueryResponse(answer=answer, sources=sources)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ingest")
async def ingest_codebase(repo_path: str):
    """
    Triggers parsing and embedding of a directory.
    """
    try:
        count = agent.ingest_repository(repo_path)
        return {"status": "success", "indexed_elements": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
`
        },
        "rag_agent.py": {
          name: "rag_agent.py",
          type: "python",
          path: "backend/rag_agent.py",
          content: `import os
from backend.vector_store import VectorStore
from backend.parser import CodeParser
from openai import OpenAI

class RAGAgent:
    """
    Coordinates the codebase ingestion and Retrieval-Augmented Generation (RAG) pipeline.
    """
    def __init__(self):
        self.vector_store = VectorStore()
        self.parser = CodeParser()
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def ingest_repository(self, repo_path: str) -> int:
        """
        Parses all supported code files in repo_path and indexes them.
        """
        parsed_elements = self.parser.parse_directory(repo_path)
        self.vector_store.clear()
        
        chunks = []
        for element in parsed_elements:
            chunk_text = f"File: {element['file']}\\nType: {element['type']}\\nName: {element['name']}\\n\\nCode:\\n{element['code']}"
            chunks.append({
                "text": chunk_text,
                "metadata": {
                    "file": element['file'],
                    "type": element['type'],
                    "name": element['name']
                }
            })
            
        self.vector_store.add_documents(chunks)
        return len(parsed_elements)

    def answer_query(self, query: str) -> tuple[str, list[dict]]:
        """
        Retrieves relevant source code and generates a response from the LLM.
        """
        # 1. Retrieve code snippets
        results = self.vector_store.similarity_search(query, k=3)
        
        context_str = ""
        sources = []
        for doc in results:
            context_str += f"--- Source: {doc['metadata']['file']} ({doc['metadata']['name']}) ---\\n{doc['text']}\\n\\n"
            sources.append(doc['metadata'])
            
        # 2. System prompt
        system_prompt = (
            "You are CodeMentor AI, a expert software engineer assisting in developer onboarding.\\n"
            "Answer the query using ONLY the source code context provided. Do not make up facts.\\n"
            "Provide explanation, point out specific lines of code, and structure your response clearly."
        )
        
        # 3. Request LLM
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context:\\n{context_str}\\n\\nQuery: {query}"}
            ]
        )
        
        return response.choices[0].message.content, sources
`
        },
        "parser.py": {
          name: "parser.py",
          type: "python",
          path: "backend/parser.py",
          content: `import os
import ast

class CodeParser:
    """
    Parses source code files to extract classes, functions, and documentation.
    """
    def __init__(self):
        self.supported_extensions = ['.py']

    def parse_file(self, file_path: str) -> list[dict]:
        """
        Uses Python AST parser to extract structural elements from a Python file.
        """
        elements = []
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        try:
            tree = ast.parse(content)
        except SyntaxError:
            return []

        # Extract functions
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                elements.append({
                    "file": file_path,
                    "name": node.name,
                    "type": "function",
                    "code": ast.get_source_segment(content, node) or ""
                })
            elif isinstance(node, ast.ClassDef):
                elements.append({
                    "file": file_path,
                    "name": node.name,
                    "type": "class",
                    "code": ast.get_source_segment(content, node) or ""
                })
                
        return elements

    def parse_directory(self, dir_path: str) -> list[dict]:
        """
        Traverses a directory and parses all matching source code files.
        """
        all_elements = []
        for root, _, files in os.walk(dir_path):
            for file in files:
                _, ext = os.path.splitext(file)
                if ext in self.supported_extensions:
                    full_path = os.path.join(root, file)
                    all_elements.extend(self.parse_file(full_path))
        return all_elements
`
        },
        "vector_store.py": {
          name: "vector_store.py",
          type: "python",
          path: "backend/vector_store.py",
          content: `import chromadb

class VectorStore:
    """
    Simple wrapper around ChromaDB for storing and querying codebase embeddings.
    """
    def __init__(self):
        self.client = chromadb.Client()
        self.collection = self.client.get_or_create_collection("codebase_index")

    def clear(self):
        """Reset the database collection."""
        self.client.delete_collection("codebase_index")
        self.collection = self.client.get_or_create_collection("codebase_index")

    def add_documents(self, documents: list[dict]):
        """
        Generates and saves embeddings for code segments.
        """
        ids = [f"doc_{i}" for i in range(len(documents))]
        texts = [doc['text'] for doc in documents]
        metadatas = [doc['metadata'] for doc in documents]
        
        self.collection.add(
            documents=texts,
            metadatas=metadatas,
            ids=ids
        )

    def similarity_search(self, query: str, k: int = 3) -> list[dict]:
        """
        Performs vector search to retrieve relevant code snippets.
        """
        results = self.collection.query(
            query_texts=[query],
            n_results=k
        )
        
        documents = []
        if results and 'documents' in results and results['documents']:
            for i in range(len(results['documents'][0])):
                documents.append({
                    "text": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i]
                })
        return documents
`
        }
      }
    }
  }
};

export const sampleQuestions = [
  {
    id: "q1",
    question: "How does CodeMentor AI parse a directory?",
    shortAnswer: "CodeMentor AI uses the `CodeParser` class in `backend/parser.py` to traverse the directory, look for `.py` files, and parse them with Python's Abstract Syntax Trees (`ast`) module to extract functions and classes."
  },
  {
    id: "q2",
    question: "Where are API routes defined?",
    shortAnswer: "The API routes are defined using FastAPI in `backend/app.py`. It has two main routes: `/api/query` for processing onboarding questions and `/api/ingest` for triggers to parse and store embeddings."
  },
  {
    id: "q3",
    question: "What is the RAG workflow here?",
    shortAnswer: "1. The user inputs a query. \n2. The system queries ChromaDB via `VectorStore.similarity_search` inside `backend/rag_agent.py` to fetch the top 3 most relevant code elements. \n3. The agent compiles these snippets into a context and passes it along with a system prompt to OpenAI's GPT-4o model to produce a grounded, precise response."
  }
];

export const mockChatAnswers = {
  "how does codementor ai parse a directory?": {
    answer: `CodeMentor AI parses a directory recursively using the \`CodeParser\` class. 

Here is the exact method responsible in **\`backend/parser.py\`**:
\`\`\`python
def parse_directory(self, dir_path: str) -> list[dict]:
    """
    Traverses a directory and parses all matching source code files.
    """
    all_elements = []
    for root, _, files in os.walk(dir_path):
        for file in files:
            _, ext = os.path.splitext(file)
            if ext in self.supported_extensions:
                full_path = os.path.join(root, file)
                all_elements.extend(self.parse_file(full_path))
    return all_elements
\`\`\`

It finds all file paths ending in \`.py\`, reads them, and utilizes the \`parse_file\` method which leverages Python's built-in \`ast\` (Abstract Syntax Tree) module to find all function and class definitions without executing the code.`,
    sources: [
      { file: "backend/parser.py", type: "class", name: "CodeParser" }
    ]
  },
  "where are api routes defined?": {
    answer: `The API endpoints are defined in **\`backend/app.py\`** using the FastAPI framework.

The main endpoints are:
1. **POST** \`/api/query\`: Processes user queries, runs similarity searches, and gets answers from the LLM.
2. **POST** \`/api/ingest\`: Triggers parsing, chunking, and indexing of the repository directory.

Here's the relevant route handler code:
\`\`\`python
@app.post("/api/query", response_model=QueryResponse)
async def query_codebase(request: QueryRequest):
    try:
        answer, sources = agent.answer_query(request.query)
        return QueryResponse(answer=answer, sources=sources)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
\`\`\``,
    sources: [
      { file: "backend/app.py", type: "module", name: "app.py" }
    ]
  },
  "what is the rag workflow here?": {
    answer: `The Retrieval-Augmented Generation (RAG) workflow is coordinated by **\`backend/rag_agent.py\`** under the \`RAGAgent\` class. 

The step-by-step pipeline works as follows:
1. **Query Retrieval**: The agent retrieves the top 3 similar code snippets from ChromaDB.
   \`\`\`python
   results = self.vector_store.similarity_search(query, k=3)
   \`\`\`
2. **Context Compilation**: The retrieved code chunks are combined into a structured string showing their file path and element name.
3. **LLM Generation**: The combined context and the user's question are sent to OpenAI's GPT-4o engine, forced to answer *only* using the provided source snippets.
   \`\`\`python
   response = self.client.chat.completions.create(
       model="gpt-4o",
       messages=[
           {"role": "system", "content": system_prompt},
           {"role": "user", "content": f"Context:\\n{context_str}\\n\\nQuery: {query}"}
       ]
   )
   \`\`\``,
    sources: [
      { file: "backend/rag_agent.py", type: "class", name: "RAGAgent" },
      { file: "backend/vector_store.py", type: "class", name: "VectorStore" }
    ]
  }
};

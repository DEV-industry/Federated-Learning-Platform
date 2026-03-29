FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
COPY main.py .
COPY federated.proto .
RUN python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. federated.proto
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=3)" || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# Etap 1: Budowanie UI (Next.js)
FROM node:20-alpine AS ui-builder
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Etap 2: Właściwa aplikacja węzła w Pythonie
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
COPY main.py he_manager.py generate_shared_he_context.py ./
COPY federated.proto .

# Kopiowanie zbudowanego UI ("out") z etapu ui-builder do folderu, którego oczekuje kod main.py
COPY --from=ui-builder /app/ui/out ./ui/out

RUN python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. federated.proto
RUN python generate_shared_he_context.py --private-out /app/shared_he_context_private.b64 --public-out /app/shared_he_context_public.b64
EXPOSE 8000 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=3)" || exit 1
CMD ["python", "main.py"]

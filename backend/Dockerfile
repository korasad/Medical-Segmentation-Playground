FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Ставим только минимально нужные системные библиотеки
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# requirements backend'а (УЖЕ без ultralytics)
COPY requirements.txt .

# Обновить pip
RUN python -m pip install --upgrade pip

# 1) CPU-версия PyTorch + torchvision
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
        torch torchvision

# 2) Лёгкий ultralytics БЕЗ зависимостей (зависимости мы уже поставили сами)
RUN pip install --no-cache-dir ultralytics --no-deps

# 3) Остальные зависимости backend'а
RUN pip install --no-cache-dir -r requirements.txt

# 4) Копируем весь backend-код
COPY . .

# 5) Стартуем FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM python:3.10-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependencias del sistema para Debian 12 (Bookworm)
RUN apt-get update && apt-get install -y curl gnupg2 apt-transport-https unixodbc-dev g++

# Registrar llaves de Microsoft para Debian 12
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list | sed 's/deb \[arch=amd64,armhf,arm64\]/deb \[arch=amd64,armhf,arm64 signed-by=\/usr\/share\/keyrings\/microsoft-prod.gpg\]/' > /etc/apt/sources.list.d/mssql-release.list

# Instalar la versión 18 del driver ODBC
RUN apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD sh -c "gunicorn -b 0.0.0.0:${PORT:-5000} app:app"

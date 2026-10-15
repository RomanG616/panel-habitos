FROM python:3.10-slim-bullseye

# 1. Evitar que Linux pida confirmaciones manuales
ENV DEBIAN_FRONTEND=noninteractive

# 2. Instalar herramientas básicas primero
RUN apt-get update && apt-get install -y curl gnupg2 apt-transport-https unixodbc-dev g++

# 3. Descargar y registrar las llaves de Microsoft usando el método moderno
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/11/prod.list | sed 's/deb \[arch=amd64,armhf,arm64\]/deb \[arch=amd64,armhf,arm64 signed-by=\/usr\/share\/keyrings\/microsoft-prod.gpg\]/' > /etc/apt/sources.list.d/mssql-release.list

# 4. Actualizar e instalar el driver de SQL Server
RUN apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql17 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 5. Instalar librerías de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copiar el resto del código
COPY . .

# 7. Iniciar la aplicación
CMD sh -c "gunicorn -b 0.0.0.0:${PORT:-5000} app:app"

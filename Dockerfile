FROM python:3.10-slim-bullseye

# Instalar dependencias del sistema y el driver de SQL Server (msodbcsql17)
RUN apt-get update && apt-get install -y curl apt-transport-https gnupg2 unixodbc-dev gcc g++ \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql17 \
    && apt-get clean

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Iniciar el servidor web (Gunicorn) escuchando en el puerto que asigne Render
CMD sh -c "gunicorn -b 0.0.0.0:${PORT:-5000} app:app"
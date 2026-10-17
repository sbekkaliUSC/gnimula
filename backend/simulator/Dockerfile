FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ngspice && rm -rf /var/lib/apt/lists/* && useradd --create-home simulator
WORKDIR /app
COPY backend/simulator/server.py /app/server.py
COPY backend/simulator/install_models.py backend/simulator/sky130-lock.json /app/
RUN python /app/install_models.py /app/models
USER simulator
ENV PORT=8080
EXPOSE 8080
CMD ["python", "/app/server.py"]

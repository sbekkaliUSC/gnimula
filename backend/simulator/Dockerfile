FROM python:3.12-slim-bookworm AS magic-build
RUN apt-get update && apt-get install -y --no-install-recommends git make gcc m4 tcl-dev tk-dev libcairo2-dev libreadline-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git init magic && cd magic && git remote add origin https://github.com/RTimothyEdwards/magic.git && git fetch --depth 1 origin bed8d4ff84333767aa923d469d339cd05c56a00a && git checkout FETCH_HEAD && ./configure --prefix=/usr/local --without-opengl && make -j4 && make install
FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ngspice tk libcairo2 libreadline8 && rm -rf /var/lib/apt/lists/* && useradd --create-home simulator
COPY --from=magic-build /usr/local /usr/local
COPY --from=magic-build /src/magic/LICENSE /app/licenses/Magic-LICENSE
WORKDIR /app
COPY backend/simulator/server.py backend/simulator/logic.py /app/
COPY backend/simulator/technology /app/technology
COPY backend/simulator/install_models.py backend/simulator/sky130-lock.json /app/
RUN python /app/install_models.py /app/models
USER simulator
ENV PORT=8080
EXPOSE 8080
CMD ["python", "/app/server.py"]

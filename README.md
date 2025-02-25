# open-playground

Experiment with local/hosted LLMs, build datasets for fine-tuning, benchmarking, and more.

## Getting Started

You can run **open-playground** locally using Docker.

The playground uses [ollama](https://ollama.com) to interact with local LLMs. Support for proprietary, hosted models is coming soon.

### I already have ollama running

If you already have ollama running on your machine, you can spin up an instance of the playground with:

```bash
docker run --rm \
    --name open-playground \
    --add-host=host.docker.internal:host-gateway \
    -p 3000:3000 \
    -e OLLAMA_HOST=http://host.docker.internal:11434 \ # Assuming ollama is running on port 11434
    -v ./playground.db:/app/playground.db \ # Optional: persist the database
    ghcr.io/prvnsmpth/open-playground:latest
```

### I don't have ollama running

You can run the playground with ollama using Docker Compose:

```bash
git clone https://github.com/prvnsmpth/open-playground.git
cd open-playground
docker compose up -d
```

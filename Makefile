# HELPER COMMANDS

TSC:= bunx tsc

build:
	$(TSC)
	docker build -t igoramadas/cloudflare-allowme .

clean:
	rm -rf ./lib
	rm -rf ./node_modules
	rm -f bun.lock

publish:
	npm publish

run:
	bun start

update:
	-bunx npm-check-updates -u
	-bun install
	$(TSC)

worker-install:
	cd worker && npm install && npm run cf-typegen

worker-dev:
	cd worker && npm run dev

worker-deploy:
	cd worker && npm run deploy

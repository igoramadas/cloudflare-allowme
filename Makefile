# HELPER COMMANDS

TSC:= ./node_modules/.bin/tsc

build:
	$(TSC)
	docker build -t igoramadas/cloudflare-allowme .

clean:
	rm -rf ./lib
	rm -rf ./node_modules
	rm -f package-lock.json

publish:
	docker buildx build --push --platform linux/amd64,linux/arm64 -t igoramadas/cloudflare-allowme .
	npm publish

run:
	$(TSC)
	npm start

update:
	-ncu -u --target minor
	-npm install
	$(TSC)

# HELPER COMMANDS

TSC:= ./node_modules/.bin/tsc

build:
	$(TSC)
	docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t igoramadas/cloudflare-allowme .

clean:
	rm -rf ./lib
	rm -rf ./node_modules
	rm -f package-lock.json

publish:
	docker push igoramadas/cloudflare-allowme
	npm publish

run:
	$(TSC)
	npm start

update:
	-ncu -u
	-npm install
	$(TSC)

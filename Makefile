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
	npm publish

run:
	$(TSC)
	npm start

update:
	-ncu -u
	-npm install
	$(TSC)

worker-install:
	cd worker && npm install && npm run cf-typegen

worker-dev:
	cd worker && npm run dev

worker-deploy:
	cd worker && npm run deploy

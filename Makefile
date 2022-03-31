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
	docker push igoramadas/cloudflare-allowme

run:
	$(TSC)
	npm start

update:
	-ncu -u
	-npm install
	$(TSC)

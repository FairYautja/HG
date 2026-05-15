extract:
    python3 -mscripts SpaceFish docusaurus

doc:
    cd docusaurus && yarn start

build:
    cd docusaurus && yarn build

push:
    git push --follow-tags

upgrade:
    cd docusaurus
    yarn upgrade @docusaurus/core@latest @docusaurus/preset-classic@latest @docusaurus/module-type-aliases@latest @docusaurus/types@latest

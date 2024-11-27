# Installation

First download the code

```
git clone
```

Next install the dependencies (on mac)

```
brew install node npm
cd rent-increases
npm install .
```

Finally, install a latex compiler (on mac)

```
brew install mactex
```

# Usage

First export data from rent manager into a file called `tenant-data.csv` and so that it has 4 columns. Name, lease start, base rent, current rent.

Next run the following command

```
node --loader ts-node/esm tex-template.ts
```

This will generate the rent increase pdfs.

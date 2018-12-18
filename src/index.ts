#!/usr/bin/env node

import { readFile, createWriteStream } from 'fs';
import { Map } from 'immutable';

import { argv } from "./yargs_config"

type JSONValue = string | number | boolean | JSONObject;

interface JSONObject {
  [key: string]: JSONValue;
}

function getFileContent(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(file, 'utf8', (err: Error, data: string) => {
      if (err)
        reject(
          new Error(`There was an error while reading file ${file}. Probably package.json for this project doesn't exists. Try npm i before using the lib again`)
        );
      else {
        resolve(data);
      }
    });
  });
}

async function extractDependencies(from: string): Promise<Array<string>> {
  // TODO: add try catch
  const file: string = await getFileContent(from);
  const fileContent: Map<string, JSONObject> = Map(JSON.parse(file));

  const dependencies = fileContent.get('dependencies');
  const devDependencies = fileContent.get('devDependencies');
  const peerDependencies = fileContent.get('peerDependencies');
  return Object.keys(Object.assign({}, dependencies, devDependencies, peerDependencies));
}

async function prepareDependenciesData(from: string): Promise<Array<string>> {
  // TODO: add try catch
  const projectDependencies: Array<string> = await extractDependencies(
    from
  );
  const libData: Array<Promise<string>> = [];
  projectDependencies.forEach(dependency => {
    libData.push(getFileContent(`node_modules/${dependency}/package.json`));
  });
  return Promise.all(libData);
}

async function convertLibDataToImmutable(
  libData: Promise<Array<string>>
): Promise<Array<Map<string, JSONObject>>> {
  const listsOfJsons = await libData;
  const arrayOfMappedJsons: Array<Map<string, JSONObject>> = [];
  listsOfJsons.forEach(mappedJson => {
    arrayOfMappedJsons.push(Map(JSON.parse(mappedJson)));
  });
  return arrayOfMappedJsons;
}

async function createArrayWithRepoData(from: string): Promise<JSONValue[][]> {
  const arrayOfMappedJsons: Array<Map<string, JSONObject>> = await convertLibDataToImmutable(prepareDependenciesData(from));
  const cumulativeData: JSONValue[][] = [];
  arrayOfMappedJsons.forEach(mappedJson => {
    const repoData: JSONValue[] = [];
    repoData.push(mappedJson.get('name'))
    repoData.push(mappedJson.get('version'));
    repoData.push(mappedJson.get('license'));
    const author = mappedJson.get('author', '');
    if (typeof author !== 'string') {
      repoData.push(author['name'])
    } else {
      repoData.push(author)
    }
    const repo = mappedJson.get('repository', '');
    if (typeof repo !== 'string') {
      repoData.push(repo['url'])
    } else {
      repoData.push(repo)
    }
    repoData.push(mappedJson.get('description'))
    if (argv.team) {
      repoData.push(argv.team)
    }
    if (argv.used) {
      repoData.push(argv.used)
    }
    cumulativeData.push(repoData);
  })
  return cumulativeData;
}

function saveToFile(librariesData: JSONValue[][]) {
  const stream = createWriteStream('test.csv');
  librariesData.forEach(libraryData => {
    let stringData = '';
    libraryData.forEach(libraryValue => {
      stringData += libraryValue + ';';
    })
    stream.write(stringData + '\n');
  })
  stream.end();
}

switch (argv._[0]) {
  case 'single':
    createArrayWithRepoData('package.json')
      .then(librariesData => saveToFile(librariesData))
      .catch(err => console.log(err.message))
    break;
  case 'multi':
    console.log(argv._[0], argv.team, argv.used);
    break;
  default:
    argv.showHelp();
}

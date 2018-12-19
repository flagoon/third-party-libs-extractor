#!/usr/bin/env node

import {
  readFile,
  createWriteStream,
  lstatSync,
  readdirSync,
  readFileSync
} from 'fs';
import { Map } from 'immutable';

import { argv } from './yargs_config';

type JSONValue = string | Array<string> | JSONObject;

interface JSONObject {
  [key: string]: JSONValue;
  appsNames?: string[];
  usedIn?: string[];
  version?: string;
  name?: JSONValue;
}

function getFileContent(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(file, 'utf8', (err: Error, data: string) => {
      if (err)
        reject(
          new Error(
            `There was an error while reading file ${file}. Probably package.json for this project doesn't exists. Try npm i before using the lib again`
          )
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

  return Object.keys(
    Object.assign({}, dependencies, devDependencies, peerDependencies)
  );
}

async function prepareDependenciesData(from: string): Promise<Array<string>> {
  // TODO: add try catch
  const projectDependencies: Array<string> = await extractDependencies(from);
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
  const arrayOfMappedJsons: Array<
    Map<string, JSONObject>
  > = await convertLibDataToImmutable(prepareDependenciesData(from));
  const cumulativeData: JSONValue[][] = [];
  arrayOfMappedJsons.forEach(mappedJson => {
    const repoData: JSONValue[] = [];
    repoData.push(mappedJson.get('name'));
    repoData.push(mappedJson.get('version'));
    repoData.push(mappedJson.get('license'));
    const author = mappedJson.get('author', '');
    if (typeof author !== 'string') {
      repoData.push(author['name']);
    } else {
      repoData.push(author);
    }
    const repo = mappedJson.get('repository', '');
    if (typeof repo !== 'string') {
      repoData.push(repo['url']);
    } else {
      repoData.push(repo);
    }
    repoData.push(mappedJson.get('description'));
    if (argv.team) {
      repoData.push(argv.team);
    }
    if (argv.used) {
      repoData.push(argv.used);
    }
    cumulativeData.push(repoData);
  });

  return cumulativeData;
}

function saveToFile(librariesData: JSONValue[][]): void {
  const stream = createWriteStream('single.csv');
  librariesData.forEach(libraryData => {
    let stringData = '';
    libraryData.forEach(libraryValue => {
      stringData += libraryValue + ';';
    });
    stream.write(stringData + '\n');
  });
  stream.end();
}

function saveMappedDataToFile(mappedData: Map<string, JSONObject>): void {
  const stream = createWriteStream('multi.csv');
  const libraries = [...mappedData.keys()];
  libraries.forEach(library => {
    const mappedKeys: JSONObject = mappedData.get(library);
    const mappedValues = Object.keys(mappedKeys).map(value => mappedKeys[value]);
    let stringData = `${library}; `;
    let stringToAdd = '';
    mappedValues.forEach(mappedValue => {
      if (typeof mappedValue === 'string') {
        stringToAdd = mappedValue;
      } else {
        stringToAdd = JSON.stringify(mappedValue)
      }
      stringData += stringToAdd + '; ';
    })
    stream.write(stringData + '\n');
  })
  stream.end();
}

function getDirectories(): string[] {
  const directoryContent: string[] = readdirSync(process.cwd());
  const directories = directoryContent.filter(directoryElement =>
    lstatSync(`${process.cwd()}/${directoryElement}`).isDirectory()
  );

  return directories;
}

function verifyDirectory(directory: string): boolean {
  const directoryContent: string[] = readdirSync(
    `${process.cwd()}/${directory}`
  );

  if (directoryContent.indexOf('package.json') !== -1) {
    return true;
  } else {
    return false;
  }
}

function getNpmDirectories(directories: string[]): string[] {
  const npmDirecories = directories.filter(directory =>
    verifyDirectory(directory)
  );

  return npmDirecories;
}

function createMapWithDependencies(dirs: string[]): Map<string, string[]> {
  if (dirs.length === 0) {
    throw new Error('There are no valid npm directories in this directory. Do you mean libex single command?');
  }
  let megaMapWithDependencies: Map<string, string[]> = Map({});

  dirs.forEach(dir => {
    const jsonContent: string = readFileSync(
      `${process.cwd()}/${dir}/package.json`,
      'utf8'
    );
    const parsedJsonContent = JSON.parse(jsonContent);
    const arrayOfDependencies: string[] = Object.keys(Object.assign(
      {},
      parsedJsonContent.dependencies,
      parsedJsonContent.devDependencies,
      parsedJsonContent.peerDependencies
    ))
    megaMapWithDependencies = megaMapWithDependencies.set(dir, arrayOfDependencies)
  });

  return megaMapWithDependencies;
}

function handleComplexValues(value: any, key: string): string {
  let newValue = '';
  if (value) {
    if (typeof value === 'string') {
      newValue = value;
    } else {
      newValue = value['key'] || '';
    }
  }

  return newValue;
}

function getMapOfLibrariesWithData(mappedDirectories: Map<string, string[]>): Map<string, JSONObject> {
  let megaCSVGenerator: Map<string, JSONObject> = Map({});
  const appsNames = [...mappedDirectories.keys()];
  appsNames.forEach(app => {
    const dependencies = mappedDirectories.get(app);
    dependencies.forEach(dependency => {
      const packageJsonContent = readFileSync(`${process.cwd()}/${app}/node_modules/${dependency}/package.json`, 'utf8');
      const parsedPJC = JSON.parse(packageJsonContent);
      const dependencyData: JSONObject = {
        version: parsedPJC.version,
        author: handleComplexValues(parsedPJC.author, 'name'),
        team: argv.team || '',
        repo: handleComplexValues(parsedPJC.repository, 'url'),
        license: parsedPJC.license || 'XXXXXXXXX',
        description: parsedPJC.description || '',
        used: argv.used || '',
        usedIn: [app]
      };
      if (megaCSVGenerator.has(dependency)) {
        const changedDependency: JSONObject = megaCSVGenerator.get(dependency)
        if (changedDependency.version < parsedPJC.version) {
          changedDependency.version = parsedPJC.version;
        }
        changedDependency.usedIn.push(app);
        megaCSVGenerator = megaCSVGenerator.set(dependency, changedDependency);
      } else {
        megaCSVGenerator = megaCSVGenerator.set(dependency, dependencyData);
      }
    })
  })
  return megaCSVGenerator;
}

switch (argv._[0]) {
  case 'single':
    createArrayWithRepoData('package.json')
      .then(librariesData => saveToFile(librariesData))
      .catch(err => console.log(err.message));
    console.log(`It's done!`);
    break;
  case 'multi':
    const validDirs = getNpmDirectories(getDirectories());
    try {
      const dependenciesInApps = createMapWithDependencies(validDirs);
      const mapOfLibrariesWithData = getMapOfLibrariesWithData(dependenciesInApps);
      saveMappedDataToFile(mapOfLibrariesWithData);
    } catch (err) {
      console.log(err.message);
    }
    console.log(`It's done!`);
    break;
  default:
    argv.showHelp();
}

import { readFile } from 'fs';
import { Map } from 'immutable';

type JSONValue = string | number | boolean | JSONObject;

interface JSONObject {
  [key: string]: JSONValue;
}

function getFileContent(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(file, 'utf8', (err: Error, data: string) => {
      if (err)
        reject(new Error(`There was an error while reading file ${file}`));
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
  return Object.keys(Object.assign({}, dependencies, devDependencies));
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
    if (typeof author === 'string') {
      repoData.push(author)
    } else {
      repoData.push(author['name'])
    }
    const repo = mappedJson.get('repository', '');
    if (typeof repo !== 'string') {
      repoData.push(repo['url'])
    }
    cumulativeData.push(repoData);
  })
  return cumulativeData;
}

createArrayWithRepoData('package.json').then(res => console.log(res))

// getFileContent('package.json')
//   .then((res: string): Map<string, JSONObject> => Map(JSON.parse(res)))
//   .then((res): Array<string> => extractDependencies(res))
//   .then(res => console.log(res[0]));

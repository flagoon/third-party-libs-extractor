import { readFile } from 'fs';
import { Map } from 'immutable';

type JSONValue = string | number | boolean | JSONObject;

interface JSONObject {
  [x: string]: JSONValue;
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

async function prepareDependenciesData(): Promise<Array<string>> {
  // TODO: add try catch
  const projectDependencies: Array<string> = await extractDependencies(
    'package.json'
  );
  const libData: Array<Promise<string>> = [];
  projectDependencies.forEach(dependency => {
    libData.push(getFileContent(`node_modules/${dependency}/package.json`));
  });
  return Promise.all(libData);
}

async function convertLibDataToMap(
  libData: Promise<Array<string>>
): Promise<Array<Map<string, JSONObject>>> {
  const x = await libData;
  const y: Array<Map<string, JSONObject>> = [];
  x.forEach(z => {
    y.push(Map(JSON.parse(z)));
  });
  return y;
}

convertLibDataToMap(prepareDependenciesData()).then(res =>
  console.log(res[0].get('version'))
);

// getFileContent('package.json')
//   .then((res: string): Map<string, JSONObject> => Map(JSON.parse(res)))
//   .then((res): Array<string> => extractDependencies(res))
//   .then(res => console.log(res[0]));

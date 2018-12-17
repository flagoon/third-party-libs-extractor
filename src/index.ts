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

function extractDependencies(
  fileContent: Map<string, JSONObject>
): Array<string> {
  const dependencies = fileContent.get('dependencies');
  const devDependencies = fileContent.get('devDependencies');
  return Object.keys(Object.assign({}, dependencies, devDependencies));
}

getFileContent('package.json')
  .then((res: string): Map<string, JSONObject> => Map(JSON.parse(res)))
  .then((res): Array<string> => extractDependencies(res))
  .then(res => console.log(res[0]));

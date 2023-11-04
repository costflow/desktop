import dayjs from 'dayjs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as _ from 'underscore';

export const checkFileExist = function (filePath) {
  return new Promise(function (resolve, reject) {
    fs.access(filePath, fs.constants.R_OK, function (err) {
      if (err) {
        return resolve(false);
      }
      resolve(true);
    });
  });
};

export const createFile = async function (filePath, content) {
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    console.log(error);
  }
};

export const appendToLedger = async function (filePath, output, indexPath) {
  filePath = path.resolve(filePath);
  const isFileExist = await checkFileExist(filePath);
  if (!isFileExist) {
    await createFile(filePath, '; Created by Costflow https://costflow.io/\n\n');
    if (indexPath) {
      indexPath = path.resolve(indexPath);
      const isIndexFileExist = await checkFileExist(indexPath);
      if (!isIndexFileExist) {
        await createFile(indexPath, '; Created by Costflow https://costflow.io/\n\n');
      }
      fs.appendFileSync(indexPath, `include "${filePath}"` + '\n\n', 'utf8');
    }
  }

  try {
    fs.appendFileSync(filePath, output + '\n\n', 'utf8');
  } catch (error) {
    console.log(error);
  }
};

export const parseDatePath = function (filePath, inputDate) {
  console.log(filePath);
  if (!filePath) return null;

  if (filePath[0] === '~') {
    filePath = filePath.replace(/^~/, os.homedir());
  }

  let compiled = _.template(filePath, {
    interpolate: /\{\{(.+?)\}\}/g
  });
  let date = inputDate || dayjs().format('YYYY-MM-DD');
  let parsedFilePath = compiled({
    YYYY: dayjs(date).format('YYYY'),
    YY: dayjs(date).format('YY'),
    MMMM: dayjs(date).format('MMMM'),
    MMM: dayjs(date).format('MMM'),
    MM: dayjs(date).format('MM'),
    M: dayjs(date).format('M'),
    DD: dayjs(date).format('DD'),
    D: dayjs(date).format('D'),
    dddd: dayjs(date).format('dddd'),
    ddd: dayjs(date).format('ddd'),
    dd: dayjs(date).format('dd'),
    d: dayjs(date).format('d')
  });
  return parsedFilePath;
};

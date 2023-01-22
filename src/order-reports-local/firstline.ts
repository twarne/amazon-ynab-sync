'use strict';

import { createReadStream } from 'fs';

type Options = {
  encoding: BufferEncoding;
  lineEnding: string;
};

export const firstline = (path: string, usrOpts?: Options): Promise<string> => {
  const opts = {
    encoding: 'utf8',
    lineEnding: '\n',
  };
  Object.assign(opts, usrOpts);
  return new Promise((resolve, reject) => {
    const rs = createReadStream(path);
    let acc = '';
    let pos = 0;
    let index;
    rs.on('data', (chunk) => {
      index = chunk.indexOf(opts.lineEnding);
      acc += chunk;
      if (index === -1) {
        pos += chunk.length;
      } else {
        pos += index;
        rs.close();
      }
    })
      .on('close', () => resolve(acc.slice(acc.charCodeAt(0) === 0xfeff ? 1 : 0, pos)))
      .on('error', (err) => reject(err));
  });
};

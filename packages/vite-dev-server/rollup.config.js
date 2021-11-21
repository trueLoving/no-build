// @ts-check
import path from 'path'
import typescript from '@rollup/plugin-typescript'

const mainConfig = {
  input: path.resolve(__dirname, 'src/main.ts'),
  plugins: [
    typescript({
      target: 'es2018',
      baseUrl: path.resolve(__dirname, 'src/'),
      paths: {
        'types/*': ['../../types/*']
      }
    })
  ],
  output: {
    file: path.resolve(__dirname, 'dist/', 'server.js'),
    sourcemap: true
  }
}

export default () => [mainConfig]
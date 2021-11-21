const fs = require('fs');
const path = require('path');
const Koa = require('koa');
const compilerSfc = require('@vue/compiler-sfc');
const compileDom = require('@vue/compiler-dom');

const app = new Koa();

function readFile(filename, encoding = 'utf-8', root = process.cwd()): string {
  const p = path.resolve(root, filename)
  return fs.readFileSync(p, encoding)
}

function rewriteImport(content: string): string {
  // from 'xx'
  // from "xx"
  // 第三方模块做语法解析，仕最靠谱的
  return content.replace(/from ['"]([^'"]+)['"]/g, function (s0, s1) {
    // import a from './c.js'不需要改写
    // 只改写需要去node_module找的
    if (s1[0] !== '.' && s1[0] !== '/') {
      return `from '/@modules/${s1}'`;
    }
    return s0;
  });
}

app.use(async (ctx) => {
  // 不能直接用static，因为要编译.vue
  const {
    request: { url, query },
  } = ctx;

  if (url == '/') {
    let content = readFile('./index.html', 'utf-8');
    content = content.replace(
      '<script',
      `
      <script>
        window.process = {env:{NODE_ENV:'DEV'}}
      </script>
      <script`
    );
    ctx.type = 'text/html';
    ctx.body = content;
  } else if (url.endsWith('.js')) {
    const content = readFile(url.slice(1), 'utf-8');
    ctx.type = 'application/javascript';
    // import xx ffrom 'vue'; 改造成 import xx from '/@module/vue'
    ctx.body = rewriteImport(content);
  } else if (url.startsWith('/@modules/')) {
    // @todo 去node_module找的
    const prefix = path.resolve('node_modules', url.replace('/@modules/', ''));
    const module = require(prefix + '/package.json').module;
    const p = path.resolve(prefix, module);
    // console.log('p', p);
    const ret = readFile(p, 'utf-8');
    ctx.type = 'application/javascript';
    ctx.body = rewriteImport(ret);
  } else if (url.indexOf('.vue') > -1) {
    // 解析单文件组件
    const p = url.split('?')[0].slice(1);
    const { descriptor } = compilerSfc.parse(readFile(p, 'utf-8'));

    if (!query.type) {
      // 这是script
      ctx.type = 'application/javascript';
      ctx.body = `
        ${rewriteImport(descriptor.script.content).replace('export default', 'const __script= ')}
        import { render as __render } from "${url}?type=template"
        __script.render = __render
        export default __script
      `;
    } else if (query.type == 'template') {
      // template模板
      const template = descriptor.template;
      const render = compileDom.compile(template.content, { mode: 'module' }).code;
      // template=>render才能执行
      ctx.type = 'application/javascript';
      ctx.body = rewriteImport(render);
    }
  } else if (url.endsWith('.css')) {
    const p = path.resolve(url.slice(1));
    const file = readFile(p, 'utf-8');
    // console.log(file.toString())
    const content = `
        const css = \`${file.toString()}\`
        let link = document.createElement('style')
        link.setAttribute('type','text/css')
        document.head.appendChild(link)
        link.innerHTML = css
        export default css     
    `;
    ctx.type = 'application/javascript';
    ctx.body = content;
  }
  else {
    ctx.body = 'body';
  }
});

app.listen(3001, () => {
  console.log(`listening on http://localhost:3001`);
});

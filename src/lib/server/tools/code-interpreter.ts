import * as fs from 'node:fs/promises'
import util from 'node:util'
import child_process from 'node:child_process'
import { type Tool } from '.'

const exec = util.promisify(child_process.exec)

export class CodeInterpreter implements Tool {
    private baseScript: string = ''

    constructor() {
        this.loadScript()
    }

    async loadScript() {
        this.baseScript = await fs.readFile('./src/sheets.py', 'utf8')
    }

    private extractCodeBlocks(responseText: string): string[] {
        const blocks = responseText.matchAll(/```python([\s\S]*?)```/g)
        return blocks.map(b => {
            const code = b[1].trim().replace(/^```python/, '').replace(/```$/, '').trim()
            return code
        }).toArray()
    }

    private async executeCode(code: string) {
        if (!this.baseScript) {
            console.error('Base script not loaded.')
            throw new Error('Base script not loaded.')
        }

        const script = `${this.baseScript}\n${code}`

        // Write the script to a file
        const scriptPath = 'script.py'
        await fs.writeFile(scriptPath, script)

        try {
            const { stdout } = await exec(`python3 ${scriptPath}`)
            return stdout
        } catch (err: any) {
            console.error('Error executing script:', err)
            return [err.stdout, err.stderr].join('\n')
        }
    }

    check(responseText: string): boolean {
        const codeBlocks = this.extractCodeBlocks(responseText)
        return codeBlocks.length > 0
    }

    async handle(responseText: string): Promise<string | null> {
        const codeBlocks = this.extractCodeBlocks(responseText)
        if (codeBlocks.length === 0) {
            return null
        }
        const codeStr = codeBlocks.join('\n')
        return await this.executeCode(codeStr)
    }
}
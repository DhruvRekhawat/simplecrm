import "dotenv/config"
import bcrypt from "bcryptjs"
import { connectDB } from "../lib/db"
import { User } from "../lib/models/user"

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const val = argv[i + 1]
      if (val && !val.startsWith("--")) {
        out[key] = val
        i++
      }
    }
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const username = args.username
  const password = args.password

  if (!username || !password) {
    console.error("Usage: tsx scripts/seed-user.ts --username <u> --password <p>")
    process.exit(1)
  }

  await connectDB()

  const existing = await User.findOne({ username })
  const passwordHash = await bcrypt.hash(password, 12)

  if (existing) {
    existing.passwordHash = passwordHash
    await existing.save()
    console.log(`Updated password for user "${username}"`)
  } else {
    await User.create({ username, passwordHash })
    console.log(`Created user "${username}"`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

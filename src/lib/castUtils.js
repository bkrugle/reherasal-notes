// Cast member data model utilities
// A cast entry is either a string (simple) or an object (with emails/members)
// { name: string, emails: string[], members: string[], isGroup: boolean }

export function castName(entry) {
  return typeof entry === 'string' ? entry : entry.name || ''
}

export function castEmails(entry) {
  if (typeof entry === 'string') return []
  return entry.emails || []
}

export function castMembers(entry) {
  if (typeof entry === 'string') return []
  return entry.members || []
}

export function isGroup(entry) {
  if (typeof entry === 'string') return false
  return entry.isGroup === true || (entry.members && entry.members.length > 0)
}

// Get all names as a flat string list for autocomplete
export function castNameList(characters) {
  return characters.map(castName).filter(Boolean)
}

// Normalize a raw characters array (may be strings or objects)
export function normalizeCast(characters) {
  if (!Array.isArray(characters)) return []
  return characters.map(c => {
    if (typeof c === 'string') return { name: c, emails: [], members: [], isGroup: false, phone: '', smsGateway: '' }
    return {
      name: c.name || '',
      emails: Array.isArray(c.emails) ? c.emails : [],
      members: Array.isArray(c.members) ? c.members : [],
      isGroup: c.isGroup || false,
      phone: c.phone || '',
      smsGateway: c.smsGateway || '',
      castMember: c.castMember || '',
    }
  }).filter(c => c.name)
}

// Get all email recipients for a cast entry name
// For groups: returns group's own emails + member emails from the full cast list
export function getEmailsForCast(name, allCast) {
  const entry = allCast.find(c => castName(c) === name)
  if (!entry) return []
  const direct = castEmails(entry)
  // If it's a group, also collect emails from member entries
  const memberEmails = castMembers(entry).flatMap(memberName => {
    return getEmailsForCast(memberName, allCast)
  })
  return [...new Set([...direct, ...memberEmails])].filter(Boolean)
}

// Get fully expanded cast list — groups are replaced by their members
// Returns array of { name, group } where group is set for group members
export function expandedCastList(characters) {
  const result = []
  for (const c of characters) {
    const char = typeof c === 'string' ? { name: c } : c
    if (char.isGroup && Array.isArray(char.members) && char.members.length > 0) {
      for (const member of char.members) {
        const memberName = typeof member === 'string' ? member : member.name
        if (memberName) result.push({ name: memberName, group: char.name, castMember: '' })
      }
    } else if (!char.isGroup && char.name) {
      result.push({ name: char.name, group: null, castMember: char.castMember || '' })
    }
  }
  return result
}

// Roles that get full access to all notes
export const FULL_ACCESS_ROLES = ['Stage Manager', 'Director', 'Asst. Director', 'Assistant Director', 'Production Manager']

// Check if a single note matches a user based on their name and staffRole
function noteMatchesUser(note, name, staffRole) {
  if (!note || note.resolved) return false
  const text = (note.text || '').toLowerCase()
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  // Check @mention
  const firstName = (name || '').split(' ')[0]
  const normName = norm(name), normFirst = norm(firstName)
  const mentionPattern = /@([a-zA-Z0-9_]+)/g
  let match
  while ((match = mentionPattern.exec(text)) !== null) {
    const tag = norm(match[1])
    if (tag === normName || tag === normFirst || normName.startsWith(tag) || normFirst.startsWith(tag)) return true
  }

  // Check #staffRole hashtag
  if (staffRole) {
    const normRole = norm(staffRole)
    const hashPattern = /#([a-zA-Z0-9_]+)/g
    while ((match = hashPattern.exec(text)) !== null) {
      const tag = norm(match[1])
      if (tag === normRole || normRole.startsWith(tag) || tag.startsWith(normRole.slice(0, 4))) return true
    }
  }

  return false
}

// Filter notes for a given session user
// Full-access roles (SM, Director, etc.) and admins see all open notes
// Everyone else sees only notes tagged to them or their department
export function getNotesForUser(notes, session) {
  if (!notes || !session) return notes || []
  const { name, staffRole, role } = session
  const isFullAccess = FULL_ACCESS_ROLES.includes(staffRole) || role === 'admin' || role === 'member'
  if (isFullAccess) return notes.filter(n => !n.resolved)
  return notes.filter(n => noteMatchesUser(n, name, staffRole))
}

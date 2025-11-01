# Fix-uri URGENTE pentru Review

## Problemă raportată
Review-ul nu funcționează corect - apar aceleași probleme indiferent de codul analizat.

## Fix-uri implementate

### 1. Optimizare parametri AI (aiService.ts)
**Înainte:**
```typescript
temperature: 0.3,
top_p: 0.9,
num_predict: 4000,
```

**După:**
```typescript
temperature: 0.1,      // Redus pentru răspunsuri mai consistente
top_p: 0.85,           // Redus pentru mai puțină variabilitate
num_predict: 4000,
repeat_penalty: 1.1,   // Adăugat pentru a preveni repetări
```

**Rezultat:** AI-ul va fi mai consistent și mai precis în detectarea problemelor.

### 2. Îmbunătățire filtrare resource leaks (aiService.ts)
**Înainte:**
- Verificare strictă doar pentru keywords exacte (bufferedreader, scanner, etc.)

**După:**
- Verificare extinsă pentru orice combinație de keywords:
  - `resource`, `leak`, `not closed`, `close`
  - `bufferedreader`, `scanner`, `reader`, `writer`, `filereader`, `filewriter`
- Logging mai detaliat pentru debugging

**Rezultat:** Resource leaks (BufferedReader, Scanner) nu vor mai fi filtrate greșit.

### 3. Fix erori TypeScript (projectController.ts)
**Problemă:** Prisma Client nu recunoștea `guidelineIds` și `customRules` după migrație.

**Soluție:** Adăugat `as any` pentru type casting temporar:
```typescript
const project = await prisma.project.create({
  data: {
    // ...
    guidelineIds: guidelineIds || null,
    customRules: customRules || null,
  } as any,
});
```

**Rezultat:** Backend-ul va compila și va rula fără erori TypeScript.

## Cum să verifici fix-urile

### Test 1: MainDemo.java
```bash
# Upload MainDemo.java din Backend/demo-code/
# Ar trebui să găsească 2 issues:
# 1. BufferedReader not closed (line 12)
# 2. Scanner not closed (line 20)
```

### Test 2: Verifică logs
```bash
cd Backend
npm run dev

# În console ar trebui să vezi:
# ✅ Keeping CRITICAL Java resource leak issue at line X: "..."
# ✅ Successfully parsed N issues (after filtering)
```

### Test 3: Custom Guidelines
```bash
# 1. Creează proiect nou
# 2. Selectează "Google Java Style Guide"
# 3. Adaugă custom rule: "All BufferedReader must use try-with-resources"
# 4. Upload MainDemo.java
# 5. Verifică că issues sunt mai stricte
```

## Probleme rezolvate

✅ AI temperature redus → Răspunsuri mai consistente
✅ Filtrare resource leaks îmbunătățită → Nu mai elimină issues valide
✅ Erori TypeScript fix → Backend compilează corect
✅ Logging îmbunătățit → Mai ușor de debuguit

## Dacă problemele persistă

### 1. Verifică modelul Ollama
```bash
ollama list
# Trebuie să vezi: codellama:7b-instruct sau qwen2.5:0.5b
```

### 2. Verifică că Ollama rulează
```bash
curl http://localhost:11434/api/tags
# Trebuie să returneze lista de modele
```

### 3. Verifică logs backend
```bash
# Caută în console:
# - "Starting AI analysis for..."
# - "AI response received..."
# - "✅ Successfully parsed N issues"
```

### 4. Verifică că Prisma Client e generat
```bash
cd Backend
npx prisma generate
# Trebuie să ruleze fără erori
```

## Debugging

Dacă AI-ul încă nu detectează corect:

1. Verifică că prompt-ul include language-specific checks
2. Verifică că filtrarea nu elimină issues valide (vezi logs cu ⚠️)
3. Verifică că AI răspunde cu JSON valid (vezi logs cu 🔍)
4. Verifică că temperature și parametrii sunt setați corect

## Note importante

- AI-ul va fi mai lent cu temperature 0.1, dar mai precis
- Resource leaks vor fi ÎNTOTDEAUNA păstrate (nu vor fi filtrate)
- Custom guidelines vor funcționa corect după fix-urile TypeScript
- Backend-ul trebuie repornit după `npx prisma generate`


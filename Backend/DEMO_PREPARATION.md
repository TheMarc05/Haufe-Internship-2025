# DEMO PREPARATION GUIDE

## Pasul 1: Actualizează Modelul LLM pentru Viteză

1. Editează `Backend/.env` și setează:
   ```
   OLLAMA_MODEL=qwen2.5:0.5b
   ```

2. Asigură-te că modelul este instalat în Ollama:
   ```bash
   ollama pull qwen2.5:0.5b
   ```

## Pasul 2: Cod Demo Pregătit

Am creat `Backend/demo-code/MainDemo.java` cu 2 probleme intenționate:
- **Issue 1**: Resource leak - BufferedReader nu este închis în finally
- **Issue 2**: Potential null pointer - Scanner nu este verificat corect

## Pasul 3: Checklist pentru Prezentare

### Partea 1: Demonstrare Code Review cu LLM Local
- [ ] Rulează aplicația (Backend + Frontend)
- [ ] Încarcă `MainDemo.java` pentru analiză
- [ ] Arată că LLM-ul detectează problemele
- [ ] Arată raportul AI cu issues găsite

### Partea 2: Custom Coding Guidelines
- [ ] Creează un nou proiect sau selectează unul existent
- [ ] Arată că poți selecta Guidelines predefined (PEP8, Google Style, etc.)
- [ ] Adaugă Custom Rules pentru proiect
- [ ] Rulează code review din nou cu guideline-urile custom
- [ ] Arată că findings-urile se schimbă în funcție de guideline-uri

### Partea 3: Comment/Reply System
- [ ] După code review, adaugă un comentariu la un issue
- [ ] Arată că AI răspunde automat la comentariul tău
- [ ] Demonstrează conversația interactivă cu AI-ul

### Partea 4: Rerun Code Review
- [ ] După modificări, rulează review din nou
- [ ] Arată că incremental review funcționează (dacă ai implementat)

## Instrucțiuni Rapide pentru Demo

1. **Start Backend:**
   ```bash
   cd Backend
   npm run dev
   ```

2. **Start Frontend:**
   ```bash
   cd Frontend
   npm run dev
   ```

3. **Încarcă cod demo:**
   - Navighează la `/analyze` în frontend
   - Selectează proiectul
   - Upload `MainDemo.java`
   - Vezi raportul AI

4. **Arată Custom Guidelines:**
   - Mergi la `/projects`
   - Creează proiect nou sau editează unul existent
   - Selectează "Coding Guidelines" (PEP8, Google Java Style, etc.)
   - Adaugă "Custom Rules" (ex: "All methods must have Javadoc comments")
   - Salvează și rulează review din nou

5. **Arată Comment/Reply:**
   - După code review, click pe un issue
   - Adaugă comentariu (ex: "Why is this a problem?")
   - AI răspunde automat
   - Continuă conversația

## Cod Demo Găsit În:
`Backend/demo-code/MainDemo.java`

## Model Recomandat pentru Viteză:
`qwen2.5:0.5b` (foarte rapid, perfect pentru demo)


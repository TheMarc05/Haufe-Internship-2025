package Demo;

import java.io.*;
import java.util.Scanner;

public class MainDemo {
    public static void main(String[] args) throws IOException {
        // DEMO CODE - Has 2 intentional issues for code review
        
        // ISSUE 1: Resource leak - BufferedReader not closed in finally block
        // Should use try-with-resources: try (BufferedReader br = new BufferedReader(...)) { ... }
        BufferedReader br = new BufferedReader(new FileReader("input.txt"));
        String line;
        while((line = br.readLine()) != null) {
            System.out.println(line);
        }
        // ❌ Missing: br.close(); or try-with-resources
        
        // ISSUE 2: Potential null pointer - Scanner not checked before use
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter name: ");
        String name = sc.nextLine();
        
        // ❌ Potential null if user just presses Enter (though nextLine() usually doesn't return null)
        // ❌ Missing null check: if (name != null && !name.isEmpty())
        String upperName = name.toUpperCase(); 
        System.out.println("Hello " + upperName);
        
        // ❌ Missing: sc.close();
    }
}

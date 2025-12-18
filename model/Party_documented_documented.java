```java
/*
Date: 18/12/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
// Getter for number of guests
public int getGuests() {
    return guests; // Return the number of guests
}
// Format party details for display
public String formatDetails() {
    return "Party Name: " + name + ", Number of Guests: " + guests; // Return formatted details
}
// Print party details to console
public void printDetails() {
    StringBuilder sb = new StringBuilder(); // StringBuilder for efficient strings
    sb.append("Party Name: ").append(name).append(", Number of Guests: ").append(guests); // Build string
    System.out.println(sb.toString()); // Output party details
}
```
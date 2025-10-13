/**
     * Gets the number of guests attending the party.
     *
     * @return The number of guests.
     */
    public int getGuests() {
        return guests;
    }
    /**
     * Formats the details of the party into a String.
     *
     * @return A formatted String containing the party details.
     */
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    /**
     * Prints the details of the party to the console.
     */
    public void printDetails() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party Name: ")
          .append(name)
          .append(", Number of Guests: ")
          .append(guests);
        System.out.println(sb.toString());
    }
}
```
/**
     * Formats the details of the party into a human-readable string.
     *
     * @return A string containing the party name and the number of guests.
     */
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    /**
     * Prints the details of the party to the console.
     *
     * This method constructs a string representation of the party's details and
     * outputs it to the standard output.
     */
    public void printDetails() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party Name: ").append(name).append(", Number of Guests: ").append(guests);
        System.out.println(sb.toString());
    }
}
```
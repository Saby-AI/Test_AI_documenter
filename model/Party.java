public class Party {
    private String name;
    private int guests;
    public Party(String name, int guests) {
        this.name = name;
        this.guests = guests;
    }
    // public void setName(String name) {
    // }
    public String getName() {
        return name;
    }
    // public void setGuests(int guests) {
    // }
    public int getGuests() {
        return guests;
    }
    public String formatDetails() {
        return "Party Name: " + name + ", Number of Guests: " + guests;
    }
    public void printDetails() {
        StringBuilder sb = new StringBuilder();
        sb.append("Party Name: ").append(name).append(", Number of Guests: ").append(guests);
        System.out.println(sb.toString());
    }
}
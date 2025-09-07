package model;
import java.util.ArrayList;
import java.util.List;
public class Party {
    private static int nextId = 1;
    private int partyid;
    private String partynumber;
    private String partyname;
    private String partytype;
    private String partygroup;
    private String partystatus;
    private List<Address> addresses = new ArrayList<>();
    private List<Communication> communications = new ArrayList<>();
    // Constructor to initialize Party object
    public Party(String name, String type, String group, String status) {
        this.partyid = nextId++;
        this.partynumber = genNumber(group);
        this.partyname = name;
        this.partytype = type;
        this.partygroup = group;
        this.partystatus = status;
    }
    // Method to generate party number based on group
    private String genNumber(String group) {
        return group.substring(0, 2).toUpperCase() + "_" + System.currentTimeMillis();
    }
    // Method to add address to the party
    public void addAddress(Address address) {
        addresses.add(address);
    }
    // Method to add communication to the party
    public void addCommunication(Communication communication) {
        communications.add(communication);
    }
    @Override
    public String toString() {
        return "Party {id:" + partyid + ", number:" + partynumber + ", name:" + partyname + ", type:" + partytype + ", group:" + partygroup + ", status:" + partystatus + ", addresses:" + addresses + ", communications:" + communications + "}";
    }
}
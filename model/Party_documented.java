package model;
import java.util.List;
import java.util.ArrayList;
/**
 * Represents a political party with various attributes and methods.
 */
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
    Party(String name, String type, String group, String status) {
        partyid = nextId++;
        partynumber = genNumber(group);
        partyname = name;
        partytype = type;
        partygroup = group;
        partystatus = status;
    }
    private String genNumber(String group) {
        return generatePrefix(group) + "_" + System.currentTimeMillis();
    }
    private String generatePrefix(String group) {
        return group.substring(0, 2).toUpperCase();
    }
    void addAddress(Address a) {
        addresses.add(a);
    }
    void addCommunication(Communication c) {
        communications.add(c);
    }
    /**
     * Returns a string representation of the Party object.
     * @return a string representation of the Party object
     */
    public String toString() {
        return "Party {id:" + partyid + ", number:" + partynumber + ", name:" + partyname + ", type:" + partytype + ", group:" + partygroup + ", status:" + partystatus + ", addresses:" + addresses + ", communications:" + communications + "}";
    }
}
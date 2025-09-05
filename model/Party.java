package model;
import java.util.ArrayList;
import java.util.List;
public class Party {
    private static int nextId = 1;
    int partyid;
    String partynumber;
    String partyname;
    String partytype;
    String partygroup;
    String partystatus;
    List<Address> addresses = new ArrayList<>();
    List<Communication> communications = new ArrayList<>();
    Party(String name, String type, String group, String status) {
        partyid = nextId++;
        partynumber = genNumber(group);
        partyname = name;
        partytype = type;
        partygroup = group;
        partystatus = status;
    }
    String genNumber(String g) {
        return g.substring(0, 2).toUpperCase() + "_" + System.currentTimeMillis();
    }
    void addAddress(Address a) {
        addresses.add(a);
    }
    void addCommunication(Communication c) {
        communications.add(c);
    }
    public String toString() {
        return "Party {id:" + partyid + ", number:" + partynumber + ", name:" + partyname + ", type:" + partytype + ", group:" + partygroup + ", status:" + partystatus + ", addresses:" + addresses + ", communications:" + communications + "}";
    }
}
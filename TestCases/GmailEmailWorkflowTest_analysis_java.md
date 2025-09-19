/*
Date: 19/09/2025
User: Agentic_AI_System_Documenter
Code Language: Java
*/
/**
 * The GmailEmailWorkflowTest class automates the Gmail email workflow using Selenium WebDriver.
 * It enables functionalities such as logging in to Gmail, composing emails, saving drafts,
 * verifying drafts, and sending emails.
 */
package main.java;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.openqa.selenium.interactions.Actions;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
public class GmailEmailWorkflowTest {
    private WebDriver driver;
    /**
     * Constructor that initializes the WebDriver for remote access to the Selenium Grid.
     * Sets Chrome options to disable certain features for better automation performance.
     *
     * @throws Exception if unable to initialize the RemoteWebDriver
     */
    public GmailEmailWorkflowTest() throws Exception {
        ChromeOptions options = new ChromeOptions();
        Map<String, Object> prefs = new HashMap<>(); // Preferences for Chrome settings
        // Disable password management features
        prefs.put("credentials_enable_service", false);
        prefs.put("profile.password_manager_leak_detection", false);
        prefs.put("profile.password_manager_enabled", false);
        options.setExperimentalOption("prefs", prefs);
        URL hubUrl = new URL("http://selenium:4444/wd/hub"); // URL for Selenium Grid
        driver = new RemoteWebDriver(hubUrl, options); // Initializing the remote WebDriver
    }
    /**
     * Logs in to Gmail with the provided email and password.
     *
     * @param email the user's email address
     * @param password the user's password
     * @throws InterruptedException if thread sleep is interrupted
     */
    public void login(String email, String password) throws InterruptedException {
        driver.get("https://mail.google.com"); // Navigate to Gmail
        Thread.sleep(3000); // Wait for the page to load
        driver.findElement(By.name("identifier")).sendKeys(email); // Enter email
        Thread.sleep(3000);
        driver.findElement(By.id("identifierNext")).click(); // Click Next
        Thread.sleep(3000);
        driver.findElement(By.name("password")).sendKeys(password); // Enter password
        Thread.sleep(3000);
        driver.findElement(By.id("passwordNext")).click(); // Click Next
        Thread.sleep(3000);
    }
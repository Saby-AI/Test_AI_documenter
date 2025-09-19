/**
     * Composes a new email, attaches a file, and saves it as a draft.
     *
     * @param recipient the email address of the recipient
     * @param subject the subject of the email
     * @param body the body content of the email
     * @param attachmentPath the file path to the attachment
     * @throws InterruptedException if thread sleep is interrupted
     */
    public void composeAndSaveDraft(String recipient, String subject, String body, String attachmentPath) throws InterruptedException {
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[contains(text(), 'Compose')]")).click(); // Open compose window
        Thread.sleep(3000);
        driver.findElement(By.name("to")).sendKeys(recipient); // Enter recipient email
        Thread.sleep(3000);
        driver.findElement(By.name("subjectbox")).sendKeys(subject); // Enter subject
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[@aria-label='Message Body']")).sendKeys(body); // Enter body
        Thread.sleep(3000);
        driver.findElement(By.xpath("//input[@type='file']")).sendKeys(attachmentPath); // Attach file
        Thread.sleep(3000);
        driver.findElement(By.xpath("//div[contains(text(), 'Close')]")).click(); // Close compose window
        Thread.sleep(3000);
    }
    /**
     * Verifies that the draft with the specified subject is present.
     *
     * @param subject the subject of the draft to verify
     * @throws InterruptedException if thread sleep is interrupted
     */
    public void verifyDraft(String subject) throws InterruptedException {
        driver.findElement(By.xpath("//a[contains(text(), 'Drafts')]")).click(); // Navigate to Drafts
        Thread.sleep(3000);
        WebElement draftEmail = driver.findElement(By.xpath("//span[contains(text(), '" + subject + "')]")); // Locate draft
        scrollIntoView(draftEmail); // Scroll to the draft email
        Thread.sleep(3000);
        draftEmail.click(); // Click on the draft to view
        Thread.sleep(3000);
    }
    /**
     * Sends the currently opened draft email.
     *
     * @throws InterruptedException if thread sleep is interrupted
     */
    public void sendDraft() throws InterruptedException {
        driver.findElement(By.xpath("//div[contains(text(), 'Send')]")).click(); // Click send button
        Thread.sleep(3000);
    }
    /**
     * Scrolls the specified WebElement into the view.
     *
     * @param element the WebElement to scroll into view
     */
    public void scrollIntoView(WebElement element) {
        Actions actions = new Actions(this.driver); // Creating an instance of Actions to handle interactions
        actions.moveToElement(element); // Move to the specified element
        actions.perform(); // Perform the action
    }
    /**
     * Closes the WebDriver and quits the browser session.
     */
    public void close() {
        if (driver != null) {
            driver.quit(); // Quit the WebDriver
        }
    }
}
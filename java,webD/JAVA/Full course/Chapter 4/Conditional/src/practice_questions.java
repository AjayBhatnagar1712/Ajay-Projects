import java.util.Scanner;
public class practice_questions {
    public static void main(String[] args) {
        /*//Q1
        int a = 10;
        if (a == 11){
            System.out.println("I am 11");
        }
        else{
            System.out.println("I am not 11");
        }*/
        //Q2
        /*Scanner sc = new Scanner(System.in);
        System.out.print("Enter marks of subject 1 :-");
        float b = sc.nextFloat();
        System.out.print("Enter marks of subject 2 :-");
        float c = sc.nextFloat();
        System.out.print("Enter marks of subject 3 :-");
        float d = sc.nextFloat();
        float Maximum_total_marks = 300.0f;
        float total_marks = b + c + d;
        float percentage = total_marks / Maximum_total_marks * 100f;
        if ( percentage >= 40 && b>=33 && c >= 33 && d >= 33){
            System.out.printf("You are pass and your total percentage is %f" , percentage);

        }
        else {
            System.out.printf("You are fail and your total percentage is %f" , percentage);
        }*/
        /*Scanner sc = new Scanner(System.in);
        System.out.print("Enter your Income  :- ");
        float input =sc.nextFloat();
        if (input > 2.5f && input <= 5.0f ){
            float tax = (input - 2.5f) * 0.05f;
            System.out.println("Tax to be payed is :-" + tax);
        } else if ( input > 5.0f && input <= 10.0f) {
            float tax1 = (5.0f - 2.5f) * 0.05f;
            float tax2 = (float) ((input - 5.0f) * 0.20f);
            float tax3 = tax1 + tax2;
            System.out.println("Tax to be payed is :- " + tax3);
        } else if ( input > 10.0f) {
            float tax1 = (5.0f - 2.5f) * 0.05f;
            float tax2 = (float) ((10.0f - 5.0f) * 0.20f);
            float tax3 = (float) ((input - 10.0f) * 0.30f);
            float tax4 = tax1 + tax2 + tax3;
            System.out.println("Tax to be payed is :- " + tax4);
        }
        else {
            System.out.println("you dont have to pay income tax");
        }*/
        //Way to do this program
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter your Income in Lakhs :- ");
        float income = sc.nextFloat();
        float tax = 0f;
        if (income<2.5f){
            tax = tax +0;
            System.out.println("You have to pay " + tax);
        } else if  (income > 2.5f && income<=5.0f){
            tax = tax + (income-2.5f) * 0.05f;
            System.out.println("You have to pay " + tax);
        } else if (income>5.0f && income<=10.0f) {
            tax = tax + 0.05f * (5.0f - 2.5f);
            tax = tax + 0.20f * (income - 5.0f);
            System.out.println("You have to pay " + tax);
        } else if (income >10.0f) {
            tax = tax + 0.05f * (5.0f - 2.5f);
            tax = tax + 0.20f * (10.f - 5.0f);
            tax = tax + 0.30f * (income - 10.f);
            System.out.println("You have to pay " + tax);
        }
        System.out.println("Thank you for using income tax calculator");
        //Q4
        /*Scanner sc = new Scanner(System.in);
        System.out.print("Input Day");
        int day = sc.nextInt();
        switch (day){
            case 1:
                System.out.println("The Day is Monday");
               break;
            case 2:
                System.out.println("The Day is Tuesday");
                break;
            case 3:
                System.out.println("The Day is Wednesday");
                break;
            case 4:
                System.out.println("The Day is Thursday");
                break;
            case 5:
                System.out.println("The Day is Friday");
                break;
            case 6:
                System.out.println("The Day is Saturday");
                break;
            case 7:
                System.out.println("The Day is Sunday");
                break;
        }*/
        //Q5
        /*Scanner sc = new Scanner(System.in);
        System.out.print("Enter Year");
        int year = sc.nextInt();
        int leap_year = year % 4;
        if(leap_year == 0){
            System.out.println("It is a leap year");
        }
        else {
            System.out.println("Its not a leap year");
        }*/
        //Q6
        /*Scanner bc = new Scanner(System.in);
        System.out.println("enter organisation url type :- ");
        String company = bc.nextLine();
        if (company.endsWith(".com")){
            System.out.println("It is a commercial website");
        } else if (company.endsWith(".org")) {
            System.out.println("It is an organsation website");
        } else if (company.endsWith(".in")) {
            System.out.println("It is an indian company");
        }*/
    }
}
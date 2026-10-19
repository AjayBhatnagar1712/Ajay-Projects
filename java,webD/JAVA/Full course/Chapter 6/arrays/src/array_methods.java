public class array_methods {
    public static void main(String[] args) {
        int[] test = new int[5];
        test [0] = 22;
        test [1] = 23;
        test [2] = 24;
        test [3] = 25;
        test [4] = 26;
        System.out.println(test.length);

        //To display all the arrays use for loop
        for (int i = 0 ; i< test.length ; i++){
            System.out.println(test[i]);
        }

        //to display the array in reverse order.
        for (int i = test.length-1 ; i >=0; i--){
            System.out.println(test[i]);
        }
        System.out.println();
        System.out.println();
        System.out.println();

        //Printing using for each loop
        for (int element : test){
            System.out.println(element);
        }
    }


}